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

pub fn bytes32_to_string(bytes: &[u8; 32]) -> Result<String, std::str::Utf8Error> {
  let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
  let utf8_str = std::str::from_utf8(&bytes[..end])?;
  Ok(utf8_str.to_string())
}

pub fn string_to_bytes32(s: &str) -> [u8; 32] {
  let mut bytes32: [u8; 32] = [0; 32];
  let bytes = s.as_bytes();
  let len = bytes.len().min(32);

  bytes32[..len].copy_from_slice(&bytes[..len]);
  bytes32
}
