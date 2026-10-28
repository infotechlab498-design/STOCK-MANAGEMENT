namespace StructStock.Domain;

public class AppException : Exception
{
    public int Status { get; }

    public AppException(int status, string message) : base(message)
    {
        Status = status;
    }
}

public static class Ids
{
    public static string New(string prefix) =>
        $"{prefix}-{Guid.NewGuid().ToString("N")[..10].ToUpperInvariant()}";
}

public static class Money
{
    public static decimal Round2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
    public static decimal Round4(decimal value) => Math.Round(value, 4, MidpointRounding.AwayFromZero);

    public static decimal WeightedAverage(decimal oldQty, decimal oldWac, decimal inQty, decimal inCost)
    {
        if (oldQty <= 0 || oldQty + inQty <= 0)
        {
            return Round4(inCost);
        }

        return Round4(((oldQty * oldWac) + (inQty * inCost)) / (oldQty + inQty));
    }
}
