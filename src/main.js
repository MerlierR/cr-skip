const TIME_RE = /([0-9]{1,2}:[0-9]{2})/
const COMMENT_LOAD_TIMEOUT = 1000

const api = new class Api {
  #MAX_SLEEP_INTERVAL = 10000

  async getComments() {
    await this.#triggerCommentLoad()
    await this.#waitForComments()

    return [...this
      .#getCommentContainer()
      .querySelectorAll('.c-comment__body .c-text')
    ].map(it => it.innerText)
  }

  async #triggerCommentLoad() {
    window.scrollBy(0, window.innerHeight)
    await this.#sleep(COMMENT_LOAD_TIMEOUT)
    window.scrollBy(0, 0 - window.innerHeight)
  }

  async #waitForComments() {
    return new Promise(async (resolve) => {
      let sleepInterval = 1000
      while (this.#getCommentContainer() == null) {
        await this.#sleep(sleepInterval)
        sleepInterval = sleepInterval >= this.#MAX_SLEEP_INTERVAL
          ? sleepInterval
          : sleepInterval * 1.5
      }

      resolve()
    })
  }

  #getCommentContainer() {
    return document.querySelector('.erc-comments')
  }

  async #sleep(millis) {
    return new Promise(res => setTimeout(res, millis))
  }
}()

window.addEventListener('load', async () => {
  document.domain = 'crunchyroll.com'

  window.addEventListener('message', async event => {
    try {
      const {origin} = event
      const {type} = (event.data || {})

      if (origin !== 'https://static.crunchyroll.com' || type == null || type !== 'video-loaded') return

      const comments = await api.getComments()
      const possibleSkips = comments
        .map(it => it.match(TIME_RE))
        .filter(it => it != null)
        .map(it => {
          const [minutes, seconds] = it[0].split(':').map(n => parseInt(n, 10))

          return ({
            time: 60 * minutes + seconds,
            timeString: `${minutes}:${seconds.toString().padStart(2, '0')}`,
            comment: it.input
          });
        });

      document.domain = 'crunchyroll.com'
      window.postMessage({
        type: 'announce-skip-times', data: possibleSkips
      }, '*')
    } catch (_) {
    }
  })
})