const spawn = require('cross-spawn-promise');
const fetch = require('node-fetch');
const ensureSlash = require('@kne/ensure-slash');
const lodash = require('lodash');

const loadNpmInfo = async (packageName) => {
    const registryDomain = await spawn('npm', ['config', 'get', 'registry']);
    let currentVersion;
    console.log(`从npm获取package[${packageName}]信息...`);
    const versionMatch = packageName.match(/@([0-9]+\.[0-9]+\.[0-9]+.*)/);
    if (versionMatch) {
        packageName = packageName.replace(versionMatch[0], '');
        currentVersion = versionMatch[1];
    }
    const response = await fetch(ensureSlash((registryDomain || 'https://registry.npmjs.com').toString().trim(), true) + packageName, {
        timeout: 60 * 1000
    });
    const packageData = await response.json();
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
    }
};

module.exports = loadNpmInfo;
