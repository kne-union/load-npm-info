
# load-npm-info


### 描述

获取包在npm上的信息


### 安装

```shell
npm i --save @kne/load-npm-info
```


### 概述

从当前registry上获取package的信息并且格式化

```js
const loadNpmInfo = require('@kne/load-npm-info');

const promise = loadNpmInfo(packageName);
// 可选第二参指定 registry（不传则用 npm config / 默认源）
const promise2 = loadNpmInfo(packageName, { registry: 'https://registry.npmmirror.com' });
```

### API

| 属性名 / 参数 | 说明 | 类型 | 默认值 |
|-------------|------|------|--------|
| packageName | 需要获取信息的包名（可含 `@version`） | string | - |
| options.registry | 可选 npm registry | string | 不传则沿用 npm 默认 |

