module.exports = {
    partial(func, ...args) {
        return (...callArgs) => func(...args, ...callArgs);
    }
};