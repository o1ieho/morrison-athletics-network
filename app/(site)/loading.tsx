import { ListSkeleton } from "@/components/skeletons";

// Schedule, news, media, teams and the other list pages. The home page,
// game, player and team pages have their own, shaped like their layouts.
export default function Loading() {
  return <ListSkeleton />;
}
