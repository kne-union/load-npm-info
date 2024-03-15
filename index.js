const spawn = require('cross-spawn-promise');
const request = require('request-promise');
const ensureSlash = require('@kne/ensure-slash');
const lodash = require('lodash');

const loadNpmInfo = async (packageName) => {
    const registryDomain = await spawn('npm', ['config', 'get', 'registry']);
    console.log(`从npm获取package[${packageName}]信息...`);
    const downloadInfo = await request(ensureSlash(registryDomain.toString().trim(), true) + packageName,{
        timeout: 60 * 1000
    });
    const packageData = JSON.parse(downloadInfo);
    return {
        name: lodash.last(packageName.split('/')),
        packageName: packageData.name,
        version: packageData['dist-tags'].latest,
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
