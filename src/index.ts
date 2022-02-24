
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from '@babel/types';


export default function vitePluginRequireTransform(fileRegex: RegExp = /.ts$|.tsx$/,prefix='_vite_plugin_require_transform_') {
	/**
	 * <path,exports>
	 */
	let importMap = new Map<string, Set<string>>();
	/**
	 * {variable,path}
	 */
	let variableMather: { [key: string]: string } = {};
	return {
		name: prefix,
		async transform(code: string, id: string) {
			let newCode = code;
			if (fileRegex.test(id)) {
				let plugins: parser.ParserPlugin[] = [];

				const ast = parser.parse(code, {
					sourceType: "module",
					plugins,
				});
				traverse(ast, {
					enter(path) {
						//require('./xxx') || require(['./xxx'], resolve)
						if (path.isIdentifier({ name: 'require' }) && t.isCallExpression(path?.parentPath?.node)) {
                            if (path.parentPath.node.arguments.length == 1) {
                                const requirePath = (path.parentPath.node.arguments[0] as t.StringLiteral).value;
                                //获取文件名
                                const requireSpecifier = requirePath.replace(/(.*\/)*([^.]+).*/ig, "$2").replace(/-/g, '_');
                                if (!importMap.has(requirePath)) {
                                    importMap.set(requirePath, new Set());
                                }
                                //require('xxx').AAA
                                if (t.isMemberExpression(path.parentPath.parentPath) && t.isIdentifier((path?.parentPath?.parentPath?.node as t.MemberExpression)?.property)) {
                                    const requirePathExports = importMap.get(requirePath);
                                    const property = (path?.parentPath?.parentPath?.node as t.MemberExpression)?.property as t.Identifier;
                                    const currentExport = property?.name;
                                    if (requirePathExports) {
                                        requirePathExports.add(currentExport);
                                        importMap.set(requirePath, requirePathExports);
                                        //替换当前行代码
                                        path.parentPath.parentPath.replaceWithSourceString(prefix + requireSpecifier + currentExport)
                                    }
                                } else {
                                    //替换当前行代码
                                    path.parentPath.replaceWithSourceString(prefix + requireSpecifier)
                                    /**
                                     * 如果是这种情况
                                     * const result = condition ? null : require('zzz/yyy/xxx');
                                     * 需要记录这个result变量，然后往下全局找找他调用了什么方法，例如
                                     * result.start();
                                     * result.stop();
                                     * 
                                     * 最终变成
                                     * import {start as _vite_plugin_require_transform_xxxstart,stop as _vite_plugin_require_transform_xxxstop} from "zzz/yyy/xxx"
                                     * const _vite_plugin_require_transform_xxx = {start:_vite_plugin_require_transform_start,stop:_vite_plugin_require_transform_stop}
                                     * const result = _vite_plugin_require_transform_xxx;
                                     */
    
                                    // case1:const result = require('zzz/yyy/xxx');
                                    if (t.isVariableDeclarator(path.parentPath?.parentPath?.node)) {
                                        const variableDeclarator: t.VariableDeclarator = path.parentPath?.parentPath?.node;
                                        variableMather[(variableDeclarator.id as t.Identifier).name] = requirePath;
                                    }
                                    //case2: const result = condition ? null : require('zzz/yyy/xxx');
                                    if (t.isConditionalExpression(path.parentPath?.parentPath?.node) && t.isVariableDeclarator(path?.parentPath?.parentPath?.parentPath?.node)) {
                                        const variableDeclarator: t.VariableDeclarator = path.parentPath?.parentPath?.parentPath?.node;
                                        variableMather[(variableDeclarator.id as t.Identifier).name] = requirePath;
                                    }
                                }
                            } else if (path.parentPath.node.arguments.length == 2) {
                                // require([], resolve)
                                const path1 = ((path.parentPath.node.arguments[0] as t.ArrayExpression).elements[0] as t.StringLiteral).value;
                                //获取文件名
                                const requireSpecifier = path1.replace(/(.*\/)*([^.]+).*/ig, "$2").replace(/-/g, '_');
                                if (!importMap.has(path1)) {
                                    importMap.set(path1, new Set());
                                }
                                const callBackName = (path.parentPath.node.arguments[1] as t.Identifier).name
                                path.parentPath.parentPath.replaceWithSourceString(`${callBackName}(${requireSpecifier})`)
                                variableMather[requireSpecifier]
                            }
						}
						
						//检查是不是XXX.forEach()
						const isRawMethodCheck = (currentExport:string)=>{
							return Object.prototype.toString.call(new Array()[currentExport]).includes("Function")||Object.prototype.toString.call(new Object()[currentExport]).includes("Function")
						}
						//存在了变量的调用
						//如：XXX.start();
						if (t.isIdentifier(path.node) && variableMather[path.node?.name]) {
							const requirePath = variableMather[path.node.name];
							const requirePathExports = importMap.get(requirePath);
							const currentExport = ((path.parentPath.node as t.MemberExpression)?.property as t.Identifier)?.name;
							if (currentExport && !isRawMethodCheck(currentExport)&&requirePathExports)
								requirePathExports.add(currentExport);
						}
					}
				});
				//插入import
				for (const importItem of importMap.entries()) {
					const requireSpecifier = importItem[0].replace(/(.*\/)*([^.]+).*/ig, "$2").replace(/-/g, '_');
					//非default
					if (importItem[1].size) {
						const importSpecifiers = []
						for (const item of importItem[1].values()) {
							item && importSpecifiers.push(t.importSpecifier(t.identifier(prefix + requireSpecifier + item), t.identifier(item)))
						}
						const importDeclaration = t.importDeclaration(importSpecifiers, t.stringLiteral(importItem[0]));
						ast.program.body.unshift(importDeclaration);
					} else {
						const importDefaultSpecifier = [t.importDefaultSpecifier(t.identifier(prefix + requireSpecifier))];
						const importDeclaration = t.importDeclaration(importDefaultSpecifier, t.stringLiteral(importItem[0]));
						ast.program.body.unshift(importDeclaration);
					}
				}
				const statementList: t.Statement[] = [];
				//插入赋值语句 例如： const _vite_plugin_require_transform_XXX = {start:_vite_plugin_require_transform__XXXstart,stop:_vite_plugin_require_transform__XXXstop}
				for (const requirePath of Object.values(variableMather)) {
					const importExports = importMap.get(requirePath);
					if (importExports?.size) {
						const requireSpecifier = requirePath.replace(/(.*\/)*([^.]+).*/ig, "$2").replace(/-/g, '_');
						const idIdentifier = t.identifier(prefix + requireSpecifier)
						const properties = []
						for (const currentExport of importExports?.values()) {
							properties.push(t.objectProperty(t.identifier(currentExport), t.identifier(prefix + requireSpecifier + currentExport)));
						}
						const initObjectExpression = t.objectExpression(properties);
						statementList.push(t.variableDeclaration('const', [t.variableDeclarator(idIdentifier, initObjectExpression)]));
					}
				}
				//把statementList插到import下方
				const index = ast.program.body.findIndex((value) => {
					return !t.isImportDeclaration(value);
				})
				ast.program.body.splice(index, 0, ...statementList);
				const output = generate(ast);
				newCode = output.code;


			}
			importMap = new Map<string, Set<string>>();
			variableMather = {};
			return { code: newCode };
		},
	};
}
