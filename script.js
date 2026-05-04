// Global scripts for NoteShare
document.addEventListener('DOMContentLoaded', () => {
    console.log('NoteShare initialized');

    // 1. Hero Typing Effect (for landing page)
    const typingElement = document.querySelector('#typing-text');
    if (typingElement) {
        const phrases = ['Share Notes.', 'Collaborate.', 'Ace Exams.', 'Learn Together.'];
        let i = 0;
        let j = 0;
        let currentPhrase = [];
        let isDeleting = false;
        let isEnd = false;

        function loop() {
            isEnd = false;
            typingElement.innerHTML = currentPhrase.join('');

            if (i < phrases.length) {
                if (!isDeleting && j < phrases[i].length) {
                    currentPhrase.push(phrases[i][j]);
                    j++;
                }

                if (isDeleting && j > 0) {
                    currentPhrase.pop();
                    j--;
                }

                if (j == phrases[i].length) {
                    isEnd = true;
                    isDeleting = true;
                }

                if (isDeleting && j == 0) {
                    currentPhrase = [];
                    isDeleting = false;
                    i++;
                    if (i == phrases.length) i = 0;
                }
            }
            const spedUp = Math.random() * (80 - 50) + 50;
            const normalSpeed = Math.random() * (300 - 200) + 200;
            const time = isEnd ? 2000 : isDeleting ? spedUp : normalSpeed;
            setTimeout(loop, time);
        }
        loop();
    }

    // 2. Toast Notification System
    window.showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-8 right-8 px-6 py-4 rounded-2xl text-white font-bold shadow-2xl transform translate-y-20 opacity-0 transition-all duration-500 z-[100] flex items-center space-x-3 ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : '✕'}</span>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-y-20', 'opacity-0');
        }, 100);

        // Remove
        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    // 3. Handle ID Copying
    const copyBtn = document.querySelector('#copyIdBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const idText = document.querySelector('#friendId')?.innerText || 'AYUSH123';
            navigator.clipboard.writeText(idText).then(() => {
                showToast('ID Copied to clipboard!', 'success');
                const originalText = copyBtn.innerText;
                copyBtn.innerText = 'Copied!';
                setTimeout(() => copyBtn.innerText = originalText, 2000);
            });
        });
    }

    // 4. Subtle Parallax for Hero Images
    document.addEventListener('mousemove', (e) => {
        const moveElements = document.querySelectorAll('.parallax');
        moveElements.forEach(el => {
            const speed = el.getAttribute('data-speed') || 0.05;
            const x = (window.innerWidth - e.pageX * speed) / 100;
            const y = (window.innerHeight - e.pageY * speed) / 100;
            el.style.transform = `translateX(${x}px) translateY(${y}px)`;
        });
    });

    // 5. Scroll to Top Logic
    const scrollBtn = document.querySelector('#scrollToTop');
    if (scrollBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                scrollBtn.classList.remove('translate-y-28', 'opacity-0');
            } else {
                scrollBtn.classList.add('translate-y-28', 'opacity-0');
            }
        });

        scrollBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
