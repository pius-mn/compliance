/**
 * Highlights a search query within a text string.
 * Returns an array of strings and JSX elements.
 */
export const highlightText = (text: string, query: string) => {
  if (!query) return text;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={index} className="bg-yellow-200 rounded-sm px-0.5">{part}</span>
    ) : (
      part
    )
  );
};
