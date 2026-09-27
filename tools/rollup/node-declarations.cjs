const {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

// Nx emits extensionless declaration imports, including Windows separators in
// its generated entry point. NodeNext consumers need explicit ESM file names.
// The published packages are "type": "module", so every .d.ts is read as ESM;
// a mirrored .d.cts tree gives `require` consumers CommonJS-flavoured types.
module.exports = function nodeDeclarations() {
  return {
    name: 'node-compatible-declarations',
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(output) {
        const declarations = [];
        const visitDirectory = (directory) => {
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const file = join(directory, entry.name);
            if (entry.isDirectory()) visitDirectory(file);
            else if (entry.name.endsWith('.d.ts')) declarations.push(file);
          }
        };
        visitDirectory(output.dir ?? dirname(output.file));
        for (const file of declarations) {
          const esm = rewriteSpecifiers(
            file,
            readFileSync(file, 'utf8'),
            '.js',
          );
          writeFileSync(file, esm);
          writeFileSync(
            file.replace(/\.d\.ts$/, '.d.cts'),
            rewriteSpecifiers(file, esm, '.cjs'),
          );
        }
      },
    },
  };
};

function rewriteSpecifiers(file, source, extension) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const edits = [];
  const visit = (node) => {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
          ? node.argument.literal
          : undefined;
    if (
      specifier &&
      ts.isStringLiteral(specifier) &&
      specifier.text.startsWith('.')
    ) {
      const target = resolveDeclaration(file, specifier.text, extension);
      if (target !== specifier.text) {
        edits.push([
          specifier.getStart(ast),
          specifier.end,
          JSON.stringify(target),
        ]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  let result = source;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) {
    result = result.slice(0, start) + text + result.slice(end);
  }
  return result;
}

function resolveDeclaration(file, specifier, extension) {
  const base = specifier.replaceAll('\\', '/').replace(/\.[cm]?js$/, '');
  const absolute = resolve(dirname(file), base);
  if (existsSync(`${absolute}.d.ts`)) return base + extension;
  if (existsSync(join(absolute, 'index.d.ts')))
    return `${base}/index${extension}`;
  return specifier;
}
