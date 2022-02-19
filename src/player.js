/**
 * @typedef {'recap'|'titlecard'|'generic'} CommentAttributesType
 */

const TRY_SKIP_GENERIC = true

const TIME_RE = /[0-9]{1,2}:[0-9]{2}/
const RECAP_RE = /recap|episode/i
const TITLECARD_RE = /TC|title/i

const COMMENT_SPLIT_RE = new RegExp(
  [
    `(${RECAP_RE.source}).*?(?<recap>${TIME_RE.source})`,
    `(${TITLECARD_RE.source}).*?(?<titlecard>${TIME_RE.source})`
  ].join('|'),
  'gi'
)

/**
 * Threshold (in seconds) to filter out almost-the-same announced skip times
 */
const TIME_DELTA = 5
/**
 * Time in ms to wait for the main window to load. The player is faster sometimes
 */
const MAIN_WAIT_TIMEOUT = 1000
/**
 * Time in ms to wait for the buttons to disappear if they are not clicked
 */
const HIDE_BUTTON_TIMEOUT = 10000

const /**CSSStyleDeclaration*/ BUTTON_CONTAINER_STYLE = `
  position: fixed;
  right: 5px;
  bottom: 80px;
  z-index: 999999;
`

const /**CSSStyleDeclaration*/ BUTTON_STYLE = `
  color: white;
  background-color: rgba(0, 0, 0, 0.25);
  border: 1px solid white;
  padding: 10px;
  margin: 0 20px 0 0;
  font-size: 1.5rem;
  cursor: pointer;
`

const calculateTime = (timeString) => {
  const [minutes, seconds] = timeString.match(TIME_RE)[0].split(':').map(n => parseInt(n, 10))
  return {
    time: 60 * minutes + seconds,
    timeString: `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
}

class CommentAttributes {
  time
  timeString
  type

  skipOthers
  showMe
  skipText

  constructor(
    time,
    timeString,
    type
  ) {
    this.time = time
    this.timeString = timeString
    this.type = type

    this.skipOthers = type !== 'generic'
    this.showMe = this.skipOthers

    this.skipText = this.#getSkipText()
  }

  /**
   * @param {string} comment
   * @param {number} time
   * @param {string} timeString
   * @returns {CommentAttributes[]}
   */
  static create(comment, time, timeString) {
    const recap = comment.match(RECAP_RE)
    const titlecard = comment.match(TITLECARD_RE)

    if (recap != null && titlecard != null) {
      const split = {
        recapTime: time,
        recapTimeString: timeString,
        titlecardTime: time,
        titlecardTimeString: timeString
      }

      comment.match(COMMENT_SPLIT_RE).forEach((partial, index) => {
        const ts = partial.match(TIME_RE)[0]
        if(partial.match(RECAP_RE) != null) {
          const {time: recapTime, timeString: recapTimeString} = calculateTime(ts)
          split.recapTime = recapTime
          split.recapTimeString = recapTimeString
        }
        if(partial.match(TITLECARD_RE)) {
          const {time: titlecardTime, timeString: titlecardTimeString} = calculateTime(ts)
          split.titlecardTime = titlecardTime
          split.titlecardTimeString = titlecardTimeString
        }
      })

      return [
        new CommentAttributes(split.recapTime, split.recapTimeString, 'recap'),
        new CommentAttributes(split.titlecardTime, split.titlecardTimeString, 'titlecard'),
      ]
    } else {
      const type = recap != null ? 'recap' : titlecard != null ? 'titlecard' : 'generic'
      return [
        new CommentAttributes(time, timeString, type)
      ]
    }
  }

  #getSkipText() {
    switch (this.type) {
      case 'titlecard':
        return `Skip to title (${this.timeString})`
      case 'recap':
        return `Skip recap (${this.timeString})`
      default:
        return `Skip to ${this.timeString}`
    }
  }
}

window.addEventListener('load', async () => {
  const $video = document.querySelector('video')
  const $container = document.querySelector('[data-testid="vilos-root_container"]')

  $video.addEventListener('loadeddata', () => {
    document.domain = 'crunchyroll.com'
    window.top.postMessage({type: 'video-loaded'}, '*')
  })

  // wait a bit for the main content to load
  await new Promise(res => setTimeout(res, MAIN_WAIT_TIMEOUT))

  document.domain = 'crunchyroll.com'
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
        .flatMap(({time, timeString, comment}) => CommentAttributes.create(comment, time, timeString))
        .filter(({showMe}, _, self) => {
          if (TRY_SKIP_GENERIC && self.some(({skipOthers}) => skipOthers)) {
            return showMe === true
          }

          return true
        })
        .sort((a, b) => a.time - b.time)
        .filter(({time}, index, self) =>
          self.findIndex(it =>
            it.time >= time - TIME_DELTA &&
            it.time <= time + TIME_DELTA
          ) === index
        )
        .forEach(({skipText, time}) => {
          const $button = document.createElement('button')
          $button.innerHTML = skipText
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
      }, HIDE_BUTTON_TIMEOUT)
    } catch (_) {
    }
  }, false)
})