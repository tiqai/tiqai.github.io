let isLocked = false

function startTetris() {
	window.open('./Games/Tetris/index.html', '_self')
}

function start2048() {
	window.open('./Games/2048/index.html', '_self')
}

function startLinkingDots() {
	window.open('./Games/LinkDots/index.html', '_self')
}

async function voteBan() {
	if (isLocked) return

	isLocked = true
	const img = document.createElement('img')
	img.src = './img/angry_smile.jpg'
	document.getElementById('image').appendChild(img)

	const audio = new Audio('./audio/rofl.mp3')
	audio.volume = 0.5
	audio.play()

	setTimeout(function () {
		img.remove()
		isLocked = false
	}, 2000)
}
