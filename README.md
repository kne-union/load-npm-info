
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

const promsie = loadNpmInfo(packageName);
```


### 示例

#### 示例代码



### API

| 属性名         | 说明        | 类型     | 默认值 |
|-------------|-----------|--------|-----|
| packageName | 需要获取信息的包名 | string | -   |

