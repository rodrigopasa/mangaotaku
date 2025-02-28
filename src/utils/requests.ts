type Primitives = string | number | boolean | Date;
type KeyValue<T = string> = { [key: string]: T };
type QueryParam = {
  [key: string]: Primitives | string[] | KeyValue<"asc" | "desc">;
};

type MDCol<T = MDEntity<any>> = {
  result: "ok" | "error";
  response: "collection" | string;
  data: T[];
  limit: number;
  offset: number;
  total: number;
} | null;

type MDEntity<T, Type = string> = {
  id: string;
  type: Type;
  attributes?: T;
  relationships?: Entities[];
} | null;

type MDChapter = MDEntity<
  {
    volume?: string;
    chapter?: string;
    title?: string;
    translatedLanguage: string;
    externalUrl?: string;
    publishAt: Date;
    createdAt: Date;
    updatedAt: Date;
    pages: number;
    version: number;
  },
  "chapter"
>;

type MDTag = MDEntity<
  {
    name: KeyValue;
    description: KeyValue;
    group: string;
    version: number;
  },
  "tag"
>;

type MDManga = MDEntity<
  {
    title: KeyValue;
    altTitles: KeyValue[];
    description: KeyValue;
    isLocked: boolean;
    links: KeyValue;
    originalLanguage: string;
    lastVolume?: string;
    lastChapter?: string;
    publicationDemographic?: string;
    status: string;
    year?: number;
    contentRating?: string;
    tags: MDTag[];
    state: string;
    chapterNumbersResetOnNewVolume: boolean;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    availableTranslatedLanguages: string[];
    latestUploadedChapter: string;
  },
  "manga"
>;

type MDCoverArt = MDEntity<
  {
    description: string;
    volume: string;
    fileName: string;
    locale: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  },
  "cover_art"
>;

type Entities = MDChapter | MDManga | MDTag | MDCoverArt;

type OutputModel = {
  manga: MDManga;
  chapter: MDChapter;
};

const baseUrl = "https://api.mangadex.org/";

export const fetchJson = async <T = any>(
  endpoint: string,
  params = {},
  config = {}
): Promise<T> => {
  const serializeParameters = (params: any) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]: any) => {
      if (Array.isArray(value)) {
        value.forEach((val) => searchParams.append(`${key}[]`, val));
      } else if (typeof value === "object") {
        Object.entries(value).forEach(([k, v]: any) =>
          searchParams.append(`${key}[${k}]`, v)
        );
      } else {
        searchParams.append(key, value);
      }
    });
    return searchParams.toString();
  };

  const mergedParams = { ...params };
  const url = new URL(`${baseUrl}${endpoint}`);
  const serializedParams = serializeParameters(mergedParams);
  url.search = serializedParams;

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
};

export const fetchCovers = async (
  ids: string[],
  order = {},
  offset = 0,
  limit = 100
): Promise<MDCol<MDManga>> => {
  return fetchJson<MDCol<MDManga>>(
    "manga",
    {
      ids: ids,
      order,
      includes: [
        "cover_art",
        "author",
        "artist",
        "tag",
        "user",
        "scanlation_group",
      ],
      offset,
      limit,
    },
    { cache: "force-cache" }
  );
};

export const fetchCover = async (image: string): Promise<string> => {
  try {
    const response = await fetch(image, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image (${response.status}): ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");
    const imageSrc = `data:image/jpeg;base64,${base64Image}`;
    return imageSrc;
  } catch (error) {
    console.error("Error fetching image:", error);
    throw error;
  }
};

const fetchLatestChapters = async (
  offset = 0,
  limit = 100
): Promise<MDCol<MDChapter>> => {
  return fetchJson<MDCol<MDChapter>>(
    "manga",
    {
      offset,
      limit,
      order: { updatedAt: "desc" },
    },
    { next: { revalidate: 60 } }
  );
};

export const getLatestManga = async (): Promise<any[]> => {
  try {
    const latest = await fetchLatestChapters(0, 60);
    const latestIds: any = latest?.data.map((k: any) => k.id);
    const covers = await fetchCovers(latestIds, { updatedAt: "desc" });

    const returnedManga = await Promise.all(
      covers?.data?.map(async (k: any) => ({
        id: k?.id,
        updatedAt: k?.attributes?.updatedAt,
        cover: await fetchCover(
          `https://uploads.mangadex.org/covers/${k?.id}/${
            k?.relationships?.find((t: any) => t?.type === "cover_art")
              ?.attributes?.fileName
          }.256.jpg`
        ),
        title:
          k?.attributes?.title?.en ||
          k?.attributes?.title?.["ja-ro"] ||
          k?.attributes?.title?.ja,
      })) || []
    );

    return returnedManga;
  } catch (error) {
    console.error("Error in getLatestManga:", error);
    throw error;
  }
};

export const searchManga = async (search: string): Promise<any[]> => {
  try {
    const searched = await fetchJson("manga", { title: search });
    const searchedIds: any = searched?.data.map((k: any) => k.id);
    const covers = await fetchCovers(searchedIds, { updatedAt: "desc" });

    const returnedManga = await Promise.all(
      covers?.data?.map(async (k: any) => ({
        id: k?.id,
        updatedAt: k?.attributes?.updatedAt,
        cover: await fetchCover(
          `https://uploads.mangadex.org/covers/${k?.id}/${
            k?.relationships?.find((t: any) => t?.type === "cover_art")
              ?.attributes?.fileName
          }.256.jpg`
        ),
        title:
          k?.attributes?.title?.en ||
          k?.attributes?.title?.["ja-ro"] ||
          k?.attributes?.title?.ja,
      })) || []
    );

    return returnedManga;
  } catch (error) {
    console.error("Error in getLatestManga:", error);
    throw error;
  }
};

export const Carousel = async (): Promise<any[]> => {
  try {
    const randomOffset = Math.floor(Math.random() * 200);
    const req = await fetchJson<MDCol<MDChapter>>(
      "manga",
      {
        offset: randomOffset,
        limit: 20,
        order: { followedCount: "desc", rating: "desc" },
      },
      { cache: "no-store" }
    );

    const mangaIds: any = req?.data?.map((m) => m?.id);
    const manga: any = await fetchCovers(mangaIds);

    const getRandomManga = (mangaData: MDCol, count: number) => {
      const shuffledManga: any = mangaData?.data?.sort(
        () => Math.random() - 0.5
      );
      return shuffledManga.slice(0, count);
    };

    const selectedManga = getRandomManga(manga, 6);

    const returnedManga = await Promise.all(
      selectedManga.map(async (manga: any) => ({
        id: manga.id,
        tags: manga.attributes.tags,
        cover: await fetchCover(
          `https://uploads.mangadex.org/covers/${manga.id}/${
            manga.relationships.find((t: any) => t.type === "cover_art")
              .attributes.fileName
          }.256.jpg`
        ),
        title: manga.attributes.title.en || manga?.attributes?.title?.["ja-ro"],
        contentRating: manga.attributes.contentRating,
        publicationDemographic: manga.attributes.publicationDemographic,
        status: manga.attributes.status,
        description: manga.attributes.description.en,
        type: manga.type,
      }))
    );

    return returnedManga;
  } catch (error) {
    console.error("Error in Carousel:", error);
    throw error;
  }
};

export const fetchTopListings = async (): Promise<{
  popular: any[];
  topRated: any[];
  topRead: any[];
}> => {
  try {
    const [reqTopFollowed, reqTopRated, reqTopRead] = await Promise.all([
      fetchJson<MDCol<MDChapter>>("manga", {
        limit: 10,
        order: { followedCount: "desc" },
      }),
      fetchJson<MDCol<MDChapter>>("manga", {
        limit: 10,
        order: { rating: "desc" },
      }),
      fetchJson<MDCol<MDChapter>>("manga", {
        limit: 10,
        order: { readingProgress: "desc" },
      }),
    ]);

    const popular = await fetchCovers(
      reqTopFollowed.data.map((manga: any) => manga.id)
    );
    const topRated = await fetchCovers(
      reqTopRated.data.map((manga: any) => manga.id)
    );
    const topRead = await fetchCovers(
      reqTopRead.data.map((manga: any) => manga.id)
    );

    return {
      popular: popular.data,
      topRated: topRated.data,
      topRead: topRead.data,
    };
  } catch (error) {
    console.error("Error in fetchTopListings:", error);
    throw error;
  }
};
