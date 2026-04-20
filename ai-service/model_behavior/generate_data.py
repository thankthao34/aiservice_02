import numpy as np
import pandas as pd

np.random.seed(42)
data = []

for _ in range(333):
    avg_price = np.random.uniform(5, 199)
    purchase_count = np.random.randint(1, 20)
    total_spent = avg_price * purchase_count * np.random.uniform(0.8, 1.2)
    fav_cat = np.random.choice([0, 2], p=[0.2, 0.8])
    data.append([avg_price, total_spent, purchase_count, fav_cat, 0])

for _ in range(334):
    avg_price = np.random.uniform(200, 999)
    purchase_count = np.random.randint(1, 15)
    total_spent = avg_price * purchase_count * np.random.uniform(0.8, 1.2)
    fav_cat = np.random.choice([0, 1, 2], p=[0.5, 0.2, 0.3])
    data.append([avg_price, total_spent, purchase_count, fav_cat, 1])

for _ in range(333):
    avg_price = np.random.uniform(1000, 3000)
    purchase_count = np.random.randint(1, 10)
    total_spent = avg_price * purchase_count * np.random.uniform(0.8, 1.2)
    fav_cat = np.random.choice([0, 1], p=[0.5, 0.5])
    data.append([avg_price, total_spent, purchase_count, fav_cat, 2])


df = pd.DataFrame(data, columns=["avg_price", "total_spent", "purchase_count", "fav_category", "label"])
df = df.sample(frac=1.0).reset_index(drop=True)
df.to_csv("training_data.csv", index=False)
print("Generated training_data.csv")
