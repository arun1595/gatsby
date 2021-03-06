const sharp = require(`sharp`)

module.exports = async function duotone(duotone, format, clonedPipeline) {
  const duotoneGradient = createDuotoneGradient(
    hexToRgb(duotone.highlight),
    hexToRgb(duotone.shadow)
  )

  // @todo remove once we upgrade to sharp v0.18 which
  // adds an alias for "jpg" to toFormat
  // @see http://sharp.dimens.io/en/stable/changelog/#v0180-30th-may-2017
  if (format === `jpg`) {
    format = `jpeg`
  }

  const duotoneImage = await clonedPipeline
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      for (let i = 0; i < data.length; i = i + info.channels) {
        const r = data[i + 0]
        const g = data[i + 1]
        const b = data[i + 2]

        // @see https://en.wikipedia.org/wiki/Relative_luminance
        const avg = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)

        data[i + 0] = duotoneGradient[avg][0]
        data[i + 1] = duotoneGradient[avg][1]
        data[i + 2] = duotoneGradient[avg][2]
      }

      return sharp(data, {
        raw: info,
      }).toFormat(format)
    })

  if (duotone.opacity) {
    return overlayDuotone(duotoneImage, clonedPipeline, duotone, format)
  } else {
    return duotoneImage
  }
}

// @see https://github.com/nagelflorian/react-duotone/blob/master/src/hex-to-rgb.js
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null
}

// @see https://github.com/nagelflorian/react-duotone/blob/master/src/create-duotone-gradient.js
function createDuotoneGradient(primaryColorRGB, secondaryColorRGB) {
  const duotoneGradient = []

  for (let i = 0; i < 256; i++) {
    const ratio = i / 255
    duotoneGradient.push([
      Math.round(
        primaryColorRGB[0] * ratio + secondaryColorRGB[0] * (1 - ratio)
      ),
      Math.round(
        primaryColorRGB[1] * ratio + secondaryColorRGB[1] * (1 - ratio)
      ),
      Math.round(
        primaryColorRGB[2] * ratio + secondaryColorRGB[2] * (1 - ratio)
      ),
    ])
  }

  return duotoneGradient
}

async function overlayDuotone(duotoneImage, originalImage, duotone, format) {
  const info = await duotoneImage
    .flatten()
    .metadata()
    .then(info => info)
  // see https://github.com/lovell/sharp/issues/859#issuecomment-311319149
  const percentGrey = Math.round((duotone.opacity / 100) * 255)
  const percentTransparency = Buffer.alloc(
    info.width * info.height,
    percentGrey
  )

  const duotoneWithTransparency = await duotoneImage
    .joinChannel(percentTransparency, {
      raw: { width: info.width, height: info.height, channels: 1 },
    })
    .raw()
    .toBuffer()

  return await originalImage
    .overlayWith(duotoneWithTransparency, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) =>
      sharp(data, {
        raw: info,
      }).toFormat(format)
    )
}
