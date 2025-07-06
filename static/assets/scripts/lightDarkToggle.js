
document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('theme-select');
    const body = document.body;
    const setTheme = (theme) => {
        body.classList.remove('classic', 'future', 'vintage', 'ocean');
        body.classList.add(theme);
        localStorage.setItem('theme', theme);
        themeSelect.value = theme;
    };

    themeSelect.addEventListener('change', () => {
        setTheme(themeSelect.value);
    });

    const savedTheme = localStorage.getItem('theme') || 'vintage';
    setTheme(savedTheme);
});
