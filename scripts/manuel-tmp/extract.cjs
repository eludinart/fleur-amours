const fs = require('fs')
const path = require('path')
const pdf = require('pdf-parse')

const pdfPath = process.argv[2]
const outPath = process.argv[3]
if (!pdfPath || !outPath) {
  console.error('Usage: node extract.cjs <input.pdf> <output.txt>')
  process.exit(1)
}

const buf = fs.readFileSync(pdfPath)
pdf(buf).then((data) => {
  fs.writeFileSync(outPath, data.text, 'utf8')
  console.log('pages', data.numpages, 'chars', data.text.length, '->', outPath)
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
