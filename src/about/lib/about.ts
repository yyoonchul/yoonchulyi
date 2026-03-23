import type { CollectionEntry } from 'astro:content';
import { getCollection, render } from 'astro:content';

type AboutCollectionName = 'aboutExperiences' | 'aboutProjects';

type RenderedCollectionEntry<C extends AboutCollectionName> = {
  entry: CollectionEntry<C>;
  Content: Awaited<ReturnType<typeof render>>['Content'];
};

async function getRenderedEntriesSorted<C extends AboutCollectionName>(
  collectionName: C,
): Promise<RenderedCollectionEntry<C>[]> {
  const entries = (await getCollection(collectionName)).sort(
    (left, right) => right.data.order - left.data.order,
  );

  return Promise.all(
    entries.map(async (entry) => {
      const { Content } = await render(entry);

      return {
        entry,
        Content,
      };
    }),
  );
}

export function getAboutExperiences() {
  return getRenderedEntriesSorted('aboutExperiences');
}

export function getAboutProjects() {
  return getRenderedEntriesSorted('aboutProjects');
}
