export class LruMap<K, V> {
  private max: number
  private map = new Map<K, V>()
  constructor(max: number) { this.max = max }
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const val = this.map.get(key)!
    this.map.delete(key)
    this.map.set(key, val)
    return val
  }
  set(key: K, val: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, val)
    if (this.map.size > this.max) {
      this.map.delete(this.map.keys().next().value!)
    }
  }
  clear(): void { this.map.clear() }
}
