import ContentEngagement from './ContentEngagement';
export default function BooksAnalytics({ rangeQuery }: { rangeQuery?: string }) {
  return <ContentEngagement kind="book" rangeQuery={rangeQuery} />;
}
