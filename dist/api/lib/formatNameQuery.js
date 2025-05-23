"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPlatformName = void 0;
const formatPlatformName = (platformName) => {
    // Split the hyphenated string and capitalize each word
    return platformName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
        .join(' '); // Join back with spaces
};
exports.formatPlatformName = formatPlatformName;
