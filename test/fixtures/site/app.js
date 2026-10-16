// Builds a tall page so scroll tests have room, then injects a delayed banner
// that shifts layout (exercises CLS), and burns a long task (exercises TBT).
const content = document.getElementById('content')

for (let i = 0; i < 60; i++) {
  const card = document.createElement('div')
  card.className = 'card'
  card.textContent = `Card ${i}`
  content.appendChild(card)
}

setTimeout(() => {
  const banner = document.createElement('div')
  banner.style.cssText = 'height:120px;background:#cde;'
  banner.textContent = 'Delayed banner'
  document.body.prepend(banner)
}, 600)

setTimeout(() => {
  const end = performance.now() + 250
  while (performance.now() < end) {
    /* burn a long task */
  }
}, 900)
