// hierarchy.js — Hierarchical modelling
// Struktur sama dengan figure.js praktikum 07: left-child right-sibling,
// createNode(transform, render, sibling, child), initNodes(id), traverse(id).
// Bedanya, node di sini dibuat lewat addNode() karena jumlahnya ratusan,
// sehingga sibling dan child terisi otomatis (tidak ditulis manual di switch).

"use strict";

var figure = [];
var stack = [];
var modelMatrix = Mat4.identity();

// Sudut sendi dalam derajat, seperti array theta[] pada figure.js
var theta = {};

let selectedNode = null;

function createNode(transform, render, sibling, child) {
  return { transform, render, sibling, child };
}

// local: fungsi yang mengembalikan matrix lokal (membaca theta), atau matrix tetap.
// info: keterangan untuk diagram tree di halaman utama.
function addNode(name, parentId, local, render, info = {}) {
  const id = figure.length;
  const node = createNode(null, render || (() => {}), null, null);
  node.id = id;
  node.name = name;
  node.parent = parentId;
  node.local = local;
  node.lastChild = null;
  node.world = Mat4.identity();
  node.info = info;
  figure.push(node);
  initNodes(id);

  if (parentId !== null) {
    const parent = figure[parentId];
    if (parent.child === null) parent.child = id;
    else figure[parent.lastChild].sibling = id;
    parent.lastChild = id;
  }
  return id;
}

// Menghitung ulang matrix lokal satu node setelah theta berubah
function initNodes(id) {
  const node = figure[id];
  node.transform = typeof node.local === "function" ? node.local() : node.local;
}

// ChildWorld = ParentWorld × ChildLocal (praktikum 03 bagian Parent dan Child)
function traverse(id) {
  if (id == null) return;
  const node = figure[id];

  stack.push(modelMatrix);
  modelMatrix = Mat4.multiply(modelMatrix, node.transform);
  node.world = modelMatrix;

  const isSelected = id === selectedNode;
  if (isSelected) currentHighlight += 1;

  node.render();
  if (node.child != null) traverse(node.child);

  if (isSelected) currentHighlight -= 1;

  modelMatrix = stack.pop();
  if (node.sibling != null) traverse(node.sibling);
}

// Posisi titik lokal sebuah node di world space (untuk lampu dan kamera)
function worldPointOf(id, point) {
  return Mat4.transformPoint(figure[id].world, point);
}
