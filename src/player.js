/**
 * Threshold (in seconds) to filter out almost-the-same announced skip times
 */
const TIME_DELTA = 5

const BUTTON_CONTAINER_STYLE = `
  position: fixed;
  right: 5px;
  bottom: 80px;
  z-index: 999999;
`

const BUTTON_STYLE = `
  color: white;
  background-color: rgba(0, 0, 0, 0.25);
  border: 1px solid white;
  padding: 10px;
  margin: 0 20px 0 0;
  font-size: 1.5rem;
  cursor: pointer;
`

window.addEventListener('load', async () => {
  document.domain = 'crunchyroll.com'

  const $video = document.querySelector('video')
  const $container = document.querySelector('[data-testid="vilos-root_container"]')

  $video.addEventListener('loadeddata', () => {
    document.domain = 'crunchyroll.com'
    window.top.postMessage({type: 'video-loaded'}, '*')
  })

  window.top.addEventListener('message', event => {
    try {
      const {origin} = event
      const {type, data} = event.data

      if (
        origin !== 'https://beta.crunchyroll.com' ||
        type == null || type !== 'announce-skip-times' ||
        data == null || data.length === 0
      ) return

      const $buttonContainer = document.createElement('div')
      $buttonContainer.style = BUTTON_CONTAINER_STYLE
      $container.appendChild($buttonContainer)

      data
        .map(it => {
          const [minutes, seconds] = it.split(':').map(n => parseInt(n, 10))
          return {text: `Skip to: ${it}`, time: 60 * minutes + seconds}
        })
        .sort((a, b) => a.time - b.time)
        .filter((value, index, self) =>
          self.findIndex(it =>
            it.time >= value.time - TIME_DELTA &&
            it.time <= value.time + TIME_DELTA
          ) === index
        )
        .forEach(({text, time}) => {
          const $button = document.createElement('button')
          $button.innerHTML = text
          $button.style = BUTTON_STYLE

          $button.onclick = () => {
            $container.removeChild($buttonContainer)
            $video.currentTime = time
          }
          $buttonContainer.appendChild($button)
        })

      setTimeout(() => {
        try {
          $container.removeChild($buttonContainer)
        } catch (_) {
        }
      }, 5000)
    } catch (_) {
    }
  }, false)
})