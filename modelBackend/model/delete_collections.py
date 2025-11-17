import chromadb

client = chromadb.HttpClient(host="localhost", port=8001)
collections = client.list_collections()

print(f"발견된 컬렉션: {len(collections)}개")
for coll in collections:
    print(f"  - {coll.name} 삭제 중...")
    client.delete_collection(name=coll.name)
    print(f"  ✅ {coll.name} 삭제 완료")

print("✅ 모든 컬렉션 삭제 완료")

