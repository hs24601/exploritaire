from itertools import islice
with open('src/App.tsx','r', encoding='utf8') as f:
    for i, line in enumerate(f, 1):
        if 1380 <= i <= 1660:
            print(f'{i:04}: {line.rstrip()}')
