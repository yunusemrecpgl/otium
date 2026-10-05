import { LinkFavicon } from './LinkFavicon';

export function LinkItemContent({ title, url }: { title: string; url?: string }) {
  return (
    <>
      <LinkFavicon key={url} title={title} url={url} />
      <span className="link-title">{title}</span>
    </>
  );
}
