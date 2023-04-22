// utils.rs
use std::collections::HashMap;

pub fn group_by<T, F, K>(iter: T, key_fn: F) -> HashMap<K, Vec<T::Item>>
where
  T: IntoIterator,
  F: Fn(&T::Item) -> K,
  K: std::hash::Hash + Eq
{
  let mut grouped = HashMap::<K, Vec<T::Item>>::new();

  for item in iter {
    let key = key_fn(&item);
    grouped.entry(key).or_insert_with(Vec::new).push(item);
  }

  return grouped;
}
  

pub fn to_ref<T:Clone>(data_refs: Vec<&T>) -> Vec<T> {
  let data = data_refs.into_iter().map(|x| x.clone()).collect();
  data
}
