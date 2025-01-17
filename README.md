# vite-plugin-require-transform


[![NPM](https://nodei.co/npm/vite-plugin-require-transform.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/vite-plugin-require-transform/)


[![npm version](https://img.shields.io/npm/v/vite-plugin-require-transform.svg)](https://www.npmjs.com/package/vite-plugin-require-transform)
A  vite plugin that converts  the code from require syntax to import 

## Why vite-plugin-require-transform

<b>"require syntax"</b> is  supported when develop with <b>Webpack</b> cause it transformed it internally.

but when serve with <b>Vite</b> error <b>"require is not defined" </b>will show up.

This plugin  amis to support require when serve with vite.


## Install

```bash
yarn add -D vite-plugin-require-transform
```
or 
```bash
npm i vite-plugin-require-transform --save-dev
```
## Usage
```
// vite.config.(t|j)s

import { defineConfig } from 'vite';

/**
 * @param match
 * Regular expression in string or Regexp type,
 *  or a match predicate  (this: vite transform context, code: string, id: file name string) => void
 * @returns transformed code
 */
import requireTransform from 'vite-plugin-require-transform';

export default defineConfig({
  plugins: [
    // passing string type Regular expression
    requireTransform(fileRegex: RegExp = /.ts$|.tsx$/,prefix:string='_vite_plugin_require_transform_'),
  ],
});
```

## What vite-plugin-require-transform actually do 

### case 1:
```typescript
const case1 = require("case1");
console.log("case1", case1)
```
will be transformed into 
``` typescript
import _vite_plugin_require_transform_case1 from "case1";
const case1 = _vite_plugin_require_transform_case1;
console.log("case1", case1);
```


### case 2:
#### example A
```typescript
const case2A = location.host == 'test' ? null : require("case2");

if(location.host == 'test1' ){
    case2A.start();
}

case2A.stop();
```
will be transformed into 
``` typescript
import { start as _vite_plugin_require_transform_case2start, stop as _vite_plugin_require_transform_case2stop } from "case2";
const _vite_plugin_require_transform_case2 = {
  start: _vite_plugin_require_transform_case2start,
  stop: _vite_plugin_require_transform_case2stop
};
const case2A = location.host == 'test' ? null : _vite_plugin_require_transform_case2;

if (location.host == 'test1') {
  case2A.start();
}

case2A.stop();
```

#### example B
``` typescript
const case2B = {
    test:require('test2B').Something
}
```
will be transformed into 
``` typescript
import { Something as _vite_plugin_require_transform_test2BSomething } from "test2B";
const case2B = {
  test: _vite_plugin_require_transform_test2BSomething
};
```

#### example C
``` typescript
const case2c =require('test2C')


case2c.forEach((item)=>{
    console.log('item',item)
})
```
will be transformed into 
``` typescript
import _vite_plugin_require_transform_test2C from "test2C";
const case2c = _vite_plugin_require_transform_test2C;
case2c.forEach(item => {
  console.log('item', item);
});
```