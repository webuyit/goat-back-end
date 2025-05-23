export const formatPlatformName = (platformName: string): string => {
    // Split the hyphenated string and capitalize each word
    return platformName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
      .join(' '); // Join back with spaces
  };