import sharp from 'sharp'
for (const s of [192, 512]) await sharp('public/favicon.svg', { density: 300 }).resize(s, s).png().toFile(`public/icon-${s}.png`)
