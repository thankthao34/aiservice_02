import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from model import build_model


def main():
    df = pd.read_csv("training_data.csv")
    x = df[["avg_price", "total_spent", "purchase_count", "fav_category"]].values
    y = df["label"].values

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x)
    joblib.dump(scaler, "scaler.pkl")

    x_train, x_test, y_train, y_test = train_test_split(x_scaled, y, test_size=0.2, random_state=42)

    model = build_model()
    model.fit(x_train, y_train, epochs=50, batch_size=32, validation_split=0.2, verbose=1)

    loss, acc = model.evaluate(x_test, y_test)
    print(f"Test Accuracy: {acc:.4f}")

    model.save("behavior_model.h5")
    print("Saved behavior_model.h5 and scaler.pkl")


if __name__ == "__main__":
    main()
