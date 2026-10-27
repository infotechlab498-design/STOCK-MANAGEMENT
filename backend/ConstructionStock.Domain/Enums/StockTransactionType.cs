namespace ConstructionStock.Domain.Enums;

public enum StockTransactionType
{
    OpeningBalance = 1,
    GoodsReceivedNote = 2,
    MaterialIssue = 3,
    SiteReturn = 4,
    TransferOut = 5,
    TransferIn = 6,
    StockAdjustment = 7
}

public enum TransferStatus
{
    Draft = 1,
    Dispatched = 2,
    InTransit = 3,
    Received = 4,
    Cancelled = 5
}
