const MEDIA_FIELDS = `
  id title { english romaji native } coverImage { extraLarge large medium }
  bannerImage format averageScore seasonYear episodes status genres
  nextAiringEpisode { episode airingAt }
  studios(isMain: true) { nodes { name } }`;

export const TRENDING = `query { Page(perPage: 20) { media(sort: TRENDING_DESC, type: ANIME) { ${MEDIA_FIELDS} } } }`;
export const TOP_AIRING = `query { Page(perPage: 20) { media(status: RELEASING, sort: POPULARITY_DESC, type: ANIME) { ${MEDIA_FIELDS} } } }`;
export const POPULAR_MOVIES = `query { Page(perPage: 20) { media(format: MOVIE, sort: POPULARITY_DESC, type: ANIME) { ${MEDIA_FIELDS} } } }`;
export const SEARCH = `query ($q: String, $page: Int) { Page(page: $page, perPage: 20) { media(search: $q, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} } } }`;
export const DETAILS = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} description(asHtml: false) } }`;
export const CHARACTERS = `query ($id: Int) { Media(id: $id, type: ANIME) { characters(sort: ROLE, perPage: 25) { edges { role node { id name { full native } image { large } } voiceActors(language: JAPANESE) { name { full } } } } } }`;
export const RECOMMENDATIONS = `query ($id: Int) { Media(id: $id, type: ANIME) { recommendations(sort: RATING_DESC, perPage: 20) { nodes { mediaRecommendation { ${MEDIA_FIELDS} } } } } }`;

/** Relations used by the season switcher (seasons, sequels, side stories). */
export const RELATIONS = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      relations {
        edges {
          relationType
          node {
            id
            type
            format
            episodes
            status
            seasonYear
            title { english romaji native }
            coverImage { extraLarge large medium }
            bannerImage
            averageScore
          }
        }
      }
    }
  }`;

export const FEATURED = `query { Page(perPage: 8) { media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} idMal description(asHtml: false) } } }`;
