interface GenreFilterProps {
  selectedGenre: string
  onGenreChange: (genre: string) => void
}

const genres = [
  { id: 'all', label: 'All Genres' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'house', label: 'House' },
  { id: 'hip-hop', label: 'Hip-Hop' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'indie', label: 'Indie' },
]

export default function GenreFilter({
  selectedGenre,
  onGenreChange,
}: GenreFilterProps) {
  return (
    <div className="genre-filter-container">
      <h3>Filter by Genre</h3>
      <div className="genre-buttons">
        {genres.map((genre) => (
          <button
            key={genre.id}
            className={`genre-button ${selectedGenre === genre.id ? 'active' : ''}`}
            onClick={() => onGenreChange(genre.id)}
          >
            {genre.label}
          </button>
        ))}
      </div>
    </div>
  )
}
