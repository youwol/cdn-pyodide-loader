
const runTimeDependencies = {
    "externals": {
        "pyodide": "^0.21.3",
        "@youwol/cdn-client": "^2.0.1"
    },
    "includedInBundle": {}
}
const externals = {
    "pyodide": {
        "commonjs": "pyodide",
        "commonjs2": "pyodide",
        "root": "pyodide_APIv021"
    },
    "@youwol/cdn-client": {
        "commonjs": "@youwol/cdn-client",
        "commonjs2": "@youwol/cdn-client",
        "root": "@youwol/cdn-client_APIv2"
    }
}
const exportedSymbols = {
    "pyodide": {
        "apiKey": "021",
        "exportedSymbol": "pyodide"
    },
    "@youwol/cdn-client": {
        "apiKey": "2",
        "exportedSymbol": "@youwol/cdn-client"
    }
}

const mainEntry : {entryFile: string,loadDependencies:string[]} = {
    "entryFile": "./index.ts",
    "loadDependencies": [
        "pyodide",
        "@youwol/cdn-client"
    ]
}

const secondaryEntries : {[k:string]:{entryFile: string, name: string, loadDependencies:string[]}}= {}

const entries = {
     '@youwol/webpm-pyodide-loader': './index.ts',
    ...Object.values(secondaryEntries).reduce( (acc,e) => ({...acc, [`@youwol/webpm-pyodide-loader/${e.name}`]:e.entryFile}), {})
}
export const setup = {
    name:'@youwol/webpm-pyodide-loader',
        assetId:'QHlvdXdvbC93ZWJwbS1weW9kaWRlLWxvYWRlcg==',
    version:'0.2.0-wip',
    shortDescription:"Packages loader for pyodide from YouWol's CDN.",
    developerDocumentation:'https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/webpm-pyodide-loader&tab=doc',
    npmPackage:'https://www.npmjs.com/package/@youwol/webpm-pyodide-loader',
    sourceGithub:'https://github.com/youwol/webpm-pyodide-loader',
    userGuide:'https://l.youwol.com/doc/@youwol/webpm-pyodide-loader',
    apiVersion:'02',
    runTimeDependencies,
    externals,
    exportedSymbols,
    entries,
    secondaryEntries,
    getDependencySymbolExported: (module:string) => {
        return `${exportedSymbols[module].exportedSymbol}_APIv${exportedSymbols[module].apiKey}`
    },

    installMainModule: ({cdnClient, installParameters}:{
        cdnClient:{install:(unknown) => Promise<WindowOrWorkerGlobalScope>},
        installParameters?
    }) => {
        const parameters = installParameters || {}
        const scripts = parameters.scripts || []
        const modules = [
            ...(parameters.modules || []),
            ...mainEntry.loadDependencies.map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/webpm-pyodide-loader_APIv02`]
        })
    },
    installAuxiliaryModule: ({name, cdnClient, installParameters}:{
        name: string,
        cdnClient:{install:(unknown) => Promise<WindowOrWorkerGlobalScope>},
        installParameters?
    }) => {
        const entry = secondaryEntries[name]
        if(!entry){
            throw Error(`Can not find the secondary entry '${name}'. Referenced in template.py?`)
        }
        const parameters = installParameters || {}
        const scripts = [
            ...(parameters.scripts || []),
            `@youwol/webpm-pyodide-loader#0.2.0-wip~dist/@youwol/webpm-pyodide-loader/${entry.name}.js`
        ]
        const modules = [
            ...(parameters.modules || []),
            ...entry.loadDependencies.map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/webpm-pyodide-loader/${entry.name}_APIv02`]
        })
    },
    getCdnDependencies(name?: string){
        if(name && !secondaryEntries[name]){
            throw Error(`Can not find the secondary entry '${name}'. Referenced in template.py?`)
        }
        const deps = name ? secondaryEntries[name].loadDependencies : mainEntry.loadDependencies

        return deps.map( d => `${d}#${runTimeDependencies.externals[d]}`)
    }
}
