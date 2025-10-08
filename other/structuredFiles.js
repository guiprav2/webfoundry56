function findFolders(paths) {
  const folderSet = new Set();

  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      folderSet.add(prefix);
    }
  }

  return folderSet;
}

function buildTree(paths) {
  const folders = findFolders(paths);
  const root = [];

  for (const path of paths) {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const fullPath = parts.slice(0, i + 1).join('/');
      const isLast = i === parts.length - 1;
      const isFolder = folders.has(fullPath);
      const isFile = isLast && !isFolder;

      if (isFile) {
        if (!current.includes(part)) {
          current.push(part);
        }
      } else {
        let existing = current.find(
          item => Array.isArray(item) && item[0] === part,
        );
        if (!existing) {
          existing = [part, []];
          current.push(existing);
        }
        current = existing[1];
      }
    }
  }

  return root;
}

function flattenTree(tree, currentPath = '', result = []) {
  for (const item of tree) {
    if (typeof item === 'string') {
      if (item && item !== '.keep') result.push([item, currentPath, false]);
    } else if (Array.isArray(item)) {
      const [folder, children] = item;
      result.push([folder, currentPath, true]);
      flattenTree(children, `${currentPath}${folder}/`, result);
    }
  }

  return result;
}

function sortTree(tree) {
  tree.sort((a, b) => {
    const aIsFolder = Array.isArray(a);
    const bIsFolder = Array.isArray(b);

    if (aIsFolder && !bIsFolder) return -1; // folders first
    if (!aIsFolder && bIsFolder) return 1;

    const aName = aIsFolder ? a[0] : a;
    const bName = bIsFolder ? b[0] : b;

    return aName.localeCompare(bName);
  });

  for (const item of tree) {
    if (Array.isArray(item)) {
      sortTree(item[1]);
    }
  }

  return tree;
}

export default function (paths) {
  const sorted = paths.slice().sort();
  const tree = buildTree(sorted);
  const sortedTree = sortTree(tree);
  return flattenTree(sortedTree);
}
