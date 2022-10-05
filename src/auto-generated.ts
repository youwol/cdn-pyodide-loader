
const runTimeDependencies = {
    "externals": {
        "pyodide": "^0.21.3",
        "@youwol/cdn-client": "^1.0.4"
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
        "root": "@youwol/cdn-client_APIv1"
    }
}
const exportedSymbols = {
    "pyodide": {
        "apiKey": "021",
        "exportedSymbol": "pyodide"
    },
    "@youwol/cdn-client": {
        "apiKey": "1",
        "exportedSymbol": "@youwol/cdn-client"
    }
}

// eslint-disable-next-line @typescript-eslint/ban-types -- allow to allow no secondary entries
const mainEntry : Object = {
    "entryFile": "./index.ts",
    "loadDependencies": [
        "pyodide"
    ]
}

// eslint-disable-next-line @typescript-eslint/ban-types -- allow to allow no secondary entries
const secondaryEntries : Object = {}
const entries = {
     '@youwol/cdn-pyodide-loader': './index.ts',
    ...Object.values(secondaryEntries).reduce( (acc,e) => ({...acc, [`@youwol/cdn-pyodide-loader/${e.name}`]:e.entryFile}), {})
}
export const setup = {
    name:'@youwol/cdn-pyodide-loader',
        assetId:'QHlvdXdvbC9jZG4tcHlvZGlkZS1sb2FkZXI=',
    version:'0.1.1-wip',
    shortDescription:"",
    developerDocumentation:'https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/cdn-pyodide-loader',
    npmPackage:'https://www.npmjs.com/package/@youwol/cdn-pyodide-loader',
    sourceGithub:'https://github.com/youwol/cdn-pyodide-loader',
    userGuide:'https://l.youwol.com/doc/@youwol/cdn-pyodide-loader',
    apiVersion:'01',
    runTimeDependencies,
    externals,
    exportedSymbols,
    entries,
    getDependencySymbolExported: (module:string) => {
        return `${exportedSymbols[module].exportedSymbol}_APIv${exportedSymbols[module].apiKey}`
    },

    installMainModule: ({cdnClient, installParameters}:{cdnClient, installParameters?}) => {
        const parameters = installParameters || {}
        const scripts = parameters.scripts || []
        const modules = [
            ...(parameters.modules || []),
            ...mainEntry['loadDependencies'].map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/cdn-pyodide-loader_APIv01`]
        })
    },
    installAuxiliaryModule: ({name, cdnClient, installParameters}:{name: string, cdnClient, installParameters?}) => {
        const entry = secondaryEntries[name]
        const parameters = installParameters || {}
        const scripts = [
            ...(parameters.scripts || []),
            `@youwol/cdn-pyodide-loader#0.1.1-wip~dist/@youwol/cdn-pyodide-loader/${entry.name}.js`
        ]
        const modules = [
            ...(parameters.modules || []),
            ...entry.loadDependencies.map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        if(!entry){
            throw Error(`Can not find the secondary entry '${name}'. Referenced in template.py?`)
        }
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/cdn-pyodide-loader/${entry.name}_APIv01`]
        })
    }
}
