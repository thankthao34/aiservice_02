// 1) Constraints
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE;

// 2) Visualize behavior graph
MATCH (u:User)-[r:VIEWED|CLICKED|ADDED_TO_CART]->(p:Product)
RETURN u, r, p
LIMIT 300;

// 3) Visualize one user journey
MATCH (u:User {id: 1})-[r:VIEWED|CLICKED|ADDED_TO_CART]->(p:Product)
RETURN u, r, p
ORDER BY r.last_at DESC
LIMIT 200;

// 4) Product-product similarity edges derived from shared behaviors
MATCH (p1:Product)-[s:SIMILAR]->(p2:Product)
RETURN p1, s, p2
ORDER BY s.weight DESC
LIMIT 150;
