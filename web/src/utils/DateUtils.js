export const formatDate = (dateString) => {
    if (dateString == null) {
        return null;
    }
    
    const parsedDate = new Date(dateString);
    
    // Check if parsing was successful and the parsed date is valid
    if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date string");
    }

    // Get the month abbreviation
    const monthAbbr = parsedDate.toLocaleString('en-US', { month: 'long' });
    
    // Get the day and pad with leading zero if necessary
    const day = String(parsedDate.getDate()).padStart(2, '0');
    
    // Get the year
    const year = parsedDate.getFullYear();

    // Construct the formatted date string
    const formattedDate = `${monthAbbr}, ${day} ${year}`;

    return formattedDate;
}