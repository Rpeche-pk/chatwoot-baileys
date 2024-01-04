/**
     * funcion para generar un pequeño delay dado el tiempo en ms
     * @param ms {number}
     * @returns {Promise<unknown>}
     */
const wait = (ms) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

const typingTime=(text) => {
    const typingSpeed = 0.125; // caracteres por segundo
    const textLength = text.length;
    const typingTime = textLength * typingSpeed*1000;
    if (textLength >= 30) {
        return getRandomDelay(4500, 3750);
    }
    return typingTime;
}

const getRandomDelay = (max, min) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports = { wait ,typingTime,getRandomDelay};