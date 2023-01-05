import shutil
from pathlib import Path

from youwol.pipelines.pipeline_typescript_weback_npm import Template, PackageType, Dependencies, \
    RunTimeDeps, generate_template, Bundles, MainModule
from youwol_utils import parse_json

folder_path = Path(__file__).parent

pkg_json = parse_json(folder_path / 'package.json')


template = Template(
    path=folder_path,
    type=PackageType.Library,
    name=pkg_json['name'],
    version=pkg_json['version'],
    shortDescription=pkg_json['description'],
    author=pkg_json['author'],
    dependencies=Dependencies(
        runTime=RunTimeDeps(
            externals={
                "pyodide": "^0.21.3",
                "@youwol/cdn-client": "^1.0.9"
            }
        ),
        devTime={
            "url": "^0.11.0",
            "crypto-browserify": "^3.12.0",
            "@youwol/http-clients": "^2.0.0",
            "@youwol/http-primitives": "^0.1.2"
        }
    ),
    bundles=Bundles(
          mainModule=MainModule(
              entryFile='./index.ts',
              loadDependencies=["pyodide"]
          )
        ),
    testConfig="https://github.com/youwol/integration-tests-conf",
    userGuide=True
    )

generate_template(template)
shutil.copyfile(
    src=folder_path / '.template' / 'src' / 'auto-generated.ts',
    dst=folder_path / 'src' / 'auto-generated.ts'
)
for file in ['README.md', '.gitignore', '.npmignore', '.prettierignore', 'LICENSE', 'package.json', 'jest.config.ts']:
    shutil.copyfile(
        src=folder_path / '.template' / file,
        dst=folder_path / file
    )
