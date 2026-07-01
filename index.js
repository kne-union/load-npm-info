const spawn = require('cross-spawn-promise');
const fetch = require('node-fetch');
const ensureSlash = require('@kne/ensure-slash');
const lodash = require('lodash');

const RETRYABLE_CODES = new Set([
    'ERR_STREAM_PREMATURE_CLOSE',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND'
]);

const FETCH_OPTIONS = {
    timeout: 60 * 1000,
    // Node 24.17+ + node-fetch@2 gzip 解压会误报 Premature close，见 nodejs/node#63989
    compress: false,
    headers: {
        Accept: 'application/vnd.npm.install-v1+json'
    }
};

const isRetryableError = (err) => {
    if (!err) {
        return false;
    }
    if (RETRYABLE_CODES.has(err.code)) {
        return true;
    }
    if (err.type === 'system') {
        return true;
    }
    return /premature close|socket hang up|network/i.test(err.message || '');
};

const fetchWithRetry = async (url, options, {retries = 3, delay = 1000} = {}) => {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (err) {
            lastError = err;
            if (attempt < retries && isRetryableError(err)) {
                console.warn(`获取 ${url} 失败 (第 ${attempt}/${retries} 次): ${err.message}，${delay * attempt}ms 后重试...`);
                await new Promise((resolve) => setTimeout(resolve, delay * attempt));
                continue;
            }
            break;
        }
    }
    throw lastError;
};

const loadNpmInfoViaCli = async (packageName) => {
    console.log(`通过 npm view 获取 package[${packageName}] 信息...`);
    const output = await spawn('npm', ['view', packageName, '--json'], {
        env: process.env,
        maxBuffer: 20 * 1024 * 1024
    });
    return JSON.parse(output.toString().trim());
};

const normalizePackageData = (packageData, packageName, currentVersion) => ({
    name: lodash.last(packageName.split('/')),
    packageName: packageData.name,
    version: currentVersion && packageData.versions[currentVersion] ? currentVersion : packageData['dist-tags']['latest'],
    distTags: packageData['dist-tags'],
    versions: lodash.transform(packageData.versions, (result, item, key) => {
        result[key] = {
            version: item.version,
            fileCount: lodash.get(item, 'dist.fileCount'),
            integrity: lodash.get(item, 'dist.integrity'),
            shasum: lodash.get(item, 'dist.shasum'),
            signatures: lodash.get(item, 'dist.signatures'),
            tarball: lodash.get(item, 'dist.tarball'),
            unpackedSize: lodash.get(item, 'dist.unpackedSize'),
            time: lodash.get(packageData, ['time', item.version])
        };
    }, {}),
    homepage: packageData.homepage,
    repository: packageData.repository,
    readme: packageData.readme
});

const loadNpmInfo = async (packageName) => {
    const registryDomain = await spawn('npm', ['config', 'get', 'registry']);
    let currentVersion;
    console.log(`从npm获取package[${packageName}]信息...`);
    const versionMatch = packageName.match(/@([0-9]+\.[0-9]+\.[0-9]+.*)/);
    if (versionMatch) {
        packageName = packageName.replace(versionMatch[0], '');
        currentVersion = versionMatch[1];
    }
    const registryUrl = ensureSlash((registryDomain || 'https://registry.npmjs.com').toString().trim(), true) + packageName;

    try {
        const packageData = await fetchWithRetry(registryUrl, FETCH_OPTIONS);
        return normalizePackageData(packageData, packageName, currentVersion);
    } catch (fetchError) {
        console.warn(`registry 请求失败: ${fetchError.message}，尝试使用 npm view 回退...`);
        try {
            const packageData = await loadNpmInfoViaCli(packageName);
            return normalizePackageData(packageData, packageName, currentVersion);
        } catch (cliError) {
            throw new Error(`获取 package[${packageName}] 信息失败: registry(${fetchError.message}); npm view(${cliError.message})`);
        }
    }
};

module.exports = loadNpmInfo;
