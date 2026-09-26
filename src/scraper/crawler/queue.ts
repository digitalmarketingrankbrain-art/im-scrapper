export interface QueueItem {
  url: string;
  depth: number;
}

/** FIFO queue with a visited-set for O(1) dedup by normalized URL. */
export class CrawlQueue {
  private items: QueueItem[] = [];
  private visited = new Set<string>();

  enqueue(url: string, depth: number): boolean {
    if (this.visited.has(url)) return false;
    this.visited.add(url);
    this.items.push({ url, depth });
    return true;
  }

  dequeue(): QueueItem | undefined {
    return this.items.shift();
  }

  get pending(): number {
    return this.items.length;
  }

  get visitedCount(): number {
    return this.visited.size;
  }
}
