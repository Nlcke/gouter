/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */

import { Application, TSConfigReader, TypeDocReader } from 'typedoc';
import fs from 'fs';

const tsconfig = {
  compilerOptions: {
    allowJs: true,
  },
  include: ['index.js'],
};

async function main() {
  const app = new Application();

  app.options.addReader(new TSConfigReader());

  app.options.addReader(new TypeDocReader());

  fs.writeFileSync('./tsconfig.json', JSON.stringify(tsconfig));

  app.bootstrap({
    entryPoints: ['index.js'],
  });

  const project = app.convert();

  if (project) {
    const outputDir = 'docs';
    await app.generateDocs(project, outputDir);
  }
}

main()
  .catch(console.error)
  .finally(() => {
    fs.unlinkSync('./tsconfig.json');
  });
