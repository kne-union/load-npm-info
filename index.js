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
    throw new Error(`获取 ${url} 失败，已重试 ${retries} 次: ${lastError.message}`);
};

const loadNpmInfo = async (packageName) => {
    const registryDomain = await spawn('npm', ['config', 'get', 'registry']);
    let currentVersion;
    console.log(`从npm获取package[${packageName}]信息...`);
    const versionMatch = packageName.match(/@([0-9]+\.[0-9]+\.[0-9]+.*)/);
    if (versionMatch) {
        packageName = packageName.replace(versionMatch[0], '');
        currentVersion = versionMatch[1];
    }
    const packageData = await fetchWithRetry(
        ensureSlash((registryDomain || 'https://registry.npmjs.com').toString().trim(), true) + packageName,
        {timeout: 60 * 1000}
    );
    return {
        name: lodash.last(packageName.split('/')),
        packageName: packageData.name,
        version: currentVersion && packageData.versions[currentVersion] ? currentVersion : packageData['dist-tags']['latest'],
        distTags: packageData['dist-tags'],
        versions: lodash.transform(packageData.versions, (result, item, key) => {
            result[key] = {
                version: item.version,
                fileCount: item.dist.fileCount,
                integrity: item.dist.integrity,
                shasum: item.dist.shasum,
                signatures: item.dist.signatures,
                tarball: item.dist.tarball,
                unpackedSize: item.dist.unpackedSize,
                time: packageData.time[item.version]
            };
        }, {}),
        homepage: packageData.homepage,
        repository: packageData.repository,
        readme: packageData.readme
    };
};

module.exports = loadNpmInfo;
