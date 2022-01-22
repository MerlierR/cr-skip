const TIME_RE = /([0-9]+:[0-9]+)/g;

window.addEventListener('load', async () => {
  document.domain = 'crunchyroll.com'

  window.addEventListener('message', event => {
    try {
      const { origin } = event
      const { type } = (event.data || {})

      if (
        origin !== 'https://static.crunchyroll.com' ||
        type == null || type !== 'video-loaded'
      ) return

      const comments = [...document
        .querySelector('.erc-comments')
        .querySelectorAll('.c-text')
      ].map(it => it.innerText)

      const possibleSkips = comments
        .map(it => it.match(TIME_RE))
        .filter(it => it != null)
        .map(it => it[0]);

      window.postMessage({
        type: 'announce-skip-times',
        data: possibleSkips
      }, '*')
    } catch(_) {}
  })
})