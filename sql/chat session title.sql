-- One short, readable title per chat session (shown in Chat History).
-- Run once in Oracle, as the same user that owns CHAT_HISTORY.
--
-- Keyed by (CUSTOMER_ID, SESSION_ID) - the same pair CHAT_HISTORY uses to
-- identify a chat - so a title always belongs to the customer who owns it.

CREATE TABLE CHAT_SESSION_TITLE (
    CUSTOMER_ID  NUMBER             NOT NULL,
    SESSION_ID   VARCHAR2(50)       NOT NULL,
    TITLE        VARCHAR2(200 CHAR) NOT NULL,
    CREATED_AT   TIMESTAMP          DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_CHAT_SESSION_TITLE PRIMARY KEY (CUSTOMER_ID, SESSION_ID),
    CONSTRAINT FK_CHAT_SESSION_TITLE_CUSTOMER
        FOREIGN KEY (CUSTOMER_ID) REFERENCES CUSTOMER(CUSTOMER_ID)
);

-- If you already ran the earlier version of this script (SESSION_ID as the
-- only key), drop it first - it only holds generated titles, nothing else:
--   DROP TABLE CHAT_SESSION_TITLE;

  SELECT OWNER, TABLE_NAME FROM ALL_TABLES
  WHERE TABLE_NAME IN ('CHAT_HISTORY', 'CHAT_SESSION_TITLE');

  SELECT * FROM CHAT_SESSION_TITLE;