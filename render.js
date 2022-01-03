import { join } from 'path';
import tempy from 'tempy';
import { readFromFile } from './utils.js';

let lottieScript;

const getHtml = async function ({ animationData, background, width, height }) {
    if (!lottieScript) {
        lottieScript = await readFromFile('./node_modules/lottie-web/build/player/lottie.min.js');
    }

    return `
<html>
<head>
  <meta charset="UTF-8">

  <script>${lottieScript}</script>

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
        
    body {
      background: ${background};
    
      ${width ? 'width: ' + width + 'px;' : ''}
      ${height ? 'height: ' + height + 'px;' : ''}
    
      overflow: hidden;
    }
  </style>
</head>

<body>

<div id="root"></div>

<script>
  const animationData = ${JSON.stringify(animationData)}
  let animation = null
  let duration
  let numFrames

  function onReady () {
    animation = lottie.loadAnimation({
      container: document.getElementById('root'),
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: animationData
    })

    duration = animation.getDuration()
    numFrames = animation.getDuration(true)

    var div = document.createElement('div')
    div.className = 'ready'
    document.body.appendChild(div)
  }

  document.addEventListener('DOMContentLoaded', onReady)
</script>

</body>
</html>
`;
}

export default async function (browsers, animationData, options = {}) {
    const {
        background = 'transparent',
        width = undefined,
        height = undefined,
        fps = ~~animationData.fr,
    } = options;

    const html = await getHtml({ animationData, background, width, height });
    const fpsRatio = ~~animationData.fr / fps;

    const directory = tempy.directory();
    const files = [];

    let currentFrame = 0;
    const promises = [];

    for (const browser of browsers) {
        promises.push(Promise.resolve().then(async () => {
            const page = await browser.newPage();

            page.on('console', console.log.bind(console));
            page.on('error', console.error.bind(console));

            await page.setContent(html);
            await page.waitForSelector('.ready');

            const rootHandle = await page.mainFrame().$('#root');

            const duration = await page.evaluate(() => duration);
            const outputNumFrames = fps * duration;

            while (currentFrame < outputNumFrames) {
                const fileName = join(directory, `file-${currentFrame}.png`);
                files[currentFrame] = fileName;

                await page.evaluate((frame) => animation.goToAndStop(frame, true), currentFrame * fpsRatio);
                await rootHandle.screenshot({ omitBackground: true, type: 'png', path: fileName });

                ++currentFrame;
            }
        }));
    }
    await Promise.all(promises);

    return { directory, files, pattern: join(directory, `file-*.png`) };
};
